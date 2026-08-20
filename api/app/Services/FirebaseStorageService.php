<?php

namespace App\Services;

use Google\Cloud\Storage\StorageClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

class FirebaseStorageService
{
    private const PROFILE_PATH_PREFIX = 'profile-images/';

    private const ALLOWED_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];

    public function isConfigured(): bool
    {
        $credentials = env('GOOGLE_APPLICATION_CREDENTIALS');
        $bucket = env('FIREBASE_STORAGE_BUCKET');

        return is_string($credentials) && $credentials !== ''
            && is_string($bucket) && $bucket !== '';
    }

    /**
     * Upload a compressed profile avatar for the authenticated user.
     *
     * @return non-empty-string Storage object path
     */
    public function uploadProfileAvatar(string $uid, UploadedFile $file): string
    {
        $this->assertValidUid($uid);

        if (! $this->isConfigured()) {
            throw new InvalidArgumentException('Firebase Storage is not configured.');
        }

        $extension = $this->extensionForMime((string) $file->getMimeType());
        $objectPath = $this->buildProfileAvatarPath($uid, $extension);

        $this->deleteOtherProfileAvatarVariants($uid, $objectPath);

        try {
            $bucket = $this->storageClient()->bucket($this->bucketName());
            $bucket->upload(
                fopen($file->getRealPath(), 'rb'),
                [
                    'name' => $objectPath,
                    'metadata' => [
                        'contentType' => (string) $file->getMimeType(),
                        'cacheControl' => 'private, max-age=3600',
                    ],
                ],
            );
        } catch (Throwable $e) {
            Log::error('Profile avatar upload failed', [
                'uid' => $uid,
                'path' => $objectPath,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $objectPath;
    }

    /**
     * Best-effort delete of a profile avatar object. Failures are logged only.
     */
    public function deleteProfileAvatar(string $uid, ?string $objectPath = null): void
    {
        $this->assertValidUid($uid);

        if (! $this->isConfigured()) {
            return;
        }

        $paths = [];
        if (is_string($objectPath) && $objectPath !== '' && $this->isSafeProfileAvatarPath($uid, $objectPath)) {
            $paths[] = $objectPath;
        }

        foreach (self::ALLOWED_EXTENSIONS as $extension) {
            $paths[] = $this->buildProfileAvatarPath($uid, $extension);
        }

        $paths = array_values(array_unique($paths));

        try {
            $bucket = $this->storageClient()->bucket($this->bucketName());
            foreach ($paths as $path) {
                try {
                    $bucket->object($path)->delete();
                } catch (Throwable $e) {
                    Log::warning('Profile avatar delete skipped', [
                        'uid' => $uid,
                        'path' => $path,
                        'exceptionClass' => $e::class,
                        'exceptionMessage' => $e->getMessage(),
                    ]);
                }
            }
        } catch (Throwable $e) {
            Log::warning('Profile avatar delete failed', [
                'uid' => $uid,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);
        }
    }

    public function signedUrlForProfileAvatar(string $uid, string $objectPath): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        if (! $this->isSafeProfileAvatarPath($uid, $objectPath)) {
            return null;
        }

        try {
            $bucket = $this->storageClient()->bucket($this->bucketName());
            $object = $bucket->object($objectPath);
            $ttlMinutes = max(1, (int) env('FIREBASE_STORAGE_SIGNED_URL_TTL_MINUTES', 60));
            $expires = new \DateTimeImmutable("+{$ttlMinutes} minutes");

            return $object->signedUrl($expires, ['version' => 'v4']);
        } catch (Throwable $e) {
            Log::warning('Profile avatar signed URL failed', [
                'uid' => $uid,
                'path' => $objectPath,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function isSafeProfileAvatarPath(string $uid, string $objectPath): bool
    {
        $this->assertValidUid($uid);

        if (! str_starts_with($objectPath, self::PROFILE_PATH_PREFIX)) {
            return false;
        }

        if (str_contains($objectPath, '..')) {
            return false;
        }

        $expectedPrefix = self::PROFILE_PATH_PREFIX.$uid.'/avatar.';

        if (! str_starts_with($objectPath, $expectedPrefix)) {
            return false;
        }

        $extension = substr($objectPath, strlen($expectedPrefix));

        return in_array($extension, self::ALLOWED_EXTENSIONS, true);
    }

    private function deleteOtherProfileAvatarVariants(string $uid, string $keepPath): void
    {
        foreach (self::ALLOWED_EXTENSIONS as $extension) {
            $path = $this->buildProfileAvatarPath($uid, $extension);
            if ($path === $keepPath) {
                continue;
            }

            try {
                $bucket = $this->storageClient()->bucket($this->bucketName());
                $bucket->object($path)->delete();
            } catch (Throwable $e) {
                Log::warning('Old profile avatar cleanup skipped', [
                    'uid' => $uid,
                    'path' => $path,
                    'exceptionMessage' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * @return non-empty-string
     */
    private function buildProfileAvatarPath(string $uid, string $extension): string
    {
        return self::PROFILE_PATH_PREFIX.$uid.'/avatar.'.$extension;
    }

    private function extensionForMime(string $mime): string
    {
        return match ($mime) {
            'image/webp' => 'webp',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            default => throw new InvalidArgumentException('Unsupported image type.'),
        };
    }

    private function assertValidUid(string $uid): void
    {
        if ($uid === '' || ! preg_match('/^[A-Za-z0-9_-]+$/', $uid)) {
            throw new InvalidArgumentException('Invalid user id.');
        }
    }

    private function bucketName(): string
    {
        return (string) env('FIREBASE_STORAGE_BUCKET');
    }

    private function storageClient(): StorageClient
    {
        return new StorageClient([
            'keyFilePath' => env('GOOGLE_APPLICATION_CREDENTIALS'),
        ]);
    }
}
