<?php

namespace App\Services;

use App\Data\VerifiedFirebaseUser;
use App\Exceptions\FirebaseAuthenticationException;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Auth;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Factory;
use Throwable;

class FirebaseAuthService
{
    private ?Auth $auth = null;

    public function isConfigured(): bool
    {
        if ($this->authEmulatorHost() !== null) {
            return true;
        }

        $path = $this->credentialsPath();

        return $path !== null && is_readable($path);
    }

    public function authEmulatorHost(): ?string
    {
        $host = env('FIREBASE_AUTH_EMULATOR_HOST');

        if (! is_string($host) || $host === '') {
            return null;
        }

        return $host;
    }

    public function credentialsPath(): ?string
    {
        $path = env('GOOGLE_APPLICATION_CREDENTIALS');

        if (! is_string($path) || $path === '') {
            return null;
        }

        return $path;
    }

    public function verifyIdToken(string $idToken): VerifiedFirebaseUser
    {
        if (! $this->isConfigured()) {
            throw new FirebaseAuthenticationException('Firebase credentials are not configured.');
        }

        try {
            $verifiedToken = $this->auth()->verifyIdToken($idToken);
            $claims = $verifiedToken->claims();

            if (app()->environment('local')) {
                Log::info('Firebase ID token verified', [
                    'uidPresent' => $claims->has('sub'),
                    'emailVerified' => (bool) $claims->get('email_verified', false),
                    'authTime' => $this->claimAsUnixString($claims->get('auth_time', null)),
                    'iat' => $this->claimAsUnixString($claims->get('iat', null)),
                    'exp' => $this->claimAsUnixString($claims->get('exp', null)),
                    'phpTime' => now()->toIso8601String(),
                    'credentialsProjectId' => $this->credentialsProjectId(),
                ]);
            }

            return new VerifiedFirebaseUser(
                uid: (string) $claims->get('sub'),
                email: $claims->has('email') ? (string) $claims->get('email') : null,
                emailVerified: (bool) $claims->get('email_verified', false),
            );
        } catch (FailedToVerifyToken $e) {
            if (app()->environment('local')) {
                Log::warning('Firebase ID token verification failed', [
                    'exceptionClass' => $e::class,
                    'safeReason' => $e->getMessage(),
                    'previousClass' => $e->getPrevious() ? $e->getPrevious()::class : null,
                    'previousMessage' => $e->getPrevious()?->getMessage(),
                    'credentialsProjectId' => $this->credentialsProjectId(),
                    'expectedProjectId' => env('FIREBASE_PROJECT_ID') ?: $this->credentialsProjectId(),
                    'phpTime' => now()->toIso8601String(),
                    'configured' => $this->isConfigured(),
                    'emulator' => $this->authEmulatorHost(),
                ]);
            }

            throw new FirebaseAuthenticationException('Invalid Firebase ID token.');
        } catch (Throwable $e) {
            if (app()->environment('local')) {
                Log::warning('Firebase ID token verification error', [
                    'exceptionClass' => $e::class,
                    'safeReason' => $e->getMessage(),
                    'previousClass' => $e->getPrevious() ? $e->getPrevious()::class : null,
                    'previousMessage' => $e->getPrevious()?->getMessage(),
                    'credentialsProjectId' => $this->credentialsProjectId(),
                    'expectedProjectId' => env('FIREBASE_PROJECT_ID') ?: $this->credentialsProjectId(),
                    'phpTime' => now()->toIso8601String(),
                    'configured' => $this->isConfigured(),
                    'emulator' => $this->authEmulatorHost(),
                ]);
            }

            throw new FirebaseAuthenticationException('Failed to verify Firebase ID token.');
        }
    }

    private function credentialsProjectId(): ?string
    {
        $path = $this->credentialsPath();
        if ($path === null || ! is_readable($path)) {
            return null;
        }

        $json = json_decode((string) file_get_contents($path), true);
        if (! is_array($json)) {
            return null;
        }

        $projectId = $json['project_id'] ?? null;

        return is_string($projectId) && $projectId !== '' ? $projectId : null;
    }

    private function claimAsUnixString(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return (string) $value->getTimestamp();
        }

        if (is_int($value) || is_float($value) || (is_string($value) && $value !== '')) {
            return (string) $value;
        }

        return null;
    }

    private function auth(): Auth
    {
        if ($this->auth === null) {
            $factory = new Factory;

            if ($this->authEmulatorHost() !== null) {
                $projectId = env('FIREBASE_PROJECT_ID', 'demo-familytask');
                $factory = $factory->withProjectId(is_string($projectId) && $projectId !== '' ? $projectId : 'demo-familytask');
            } else {
                $factory = $factory->withServiceAccount($this->credentialsPath());
            }

            $this->auth = $factory->createAuth();
        }

        return $this->auth;
    }
}
