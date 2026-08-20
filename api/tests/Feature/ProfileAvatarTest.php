<?php

namespace Tests\Feature;

use App\Data\UserProfileData;
use App\Exceptions\ProfileServiceException;
use App\Services\FirebaseStorageService;
use App\Services\UserProfileService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use Tests\TestCase;

class ProfileAvatarTest extends TestCase
{
    public function test_profile_avatar_upload_requires_authentication(): void
    {
        $response = $this->post('/api/profile/avatar', [
            'avatar' => UploadedFile::fake()->image('avatar.webp', 100, 100)->size(100),
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_profile_avatar_delete_requires_authentication(): void
    {
        $response = $this->deleteJson('/api/profile/avatar');

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_profile_avatar_upload_rejects_invalid_file(): void
    {
        $this->mock(FirebaseStorageService::class, function (MockInterface $mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
        });

        $response = $this->post('/api/profile/avatar', [
            'avatar' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response->assertUnprocessable();
    }

    public function test_profile_avatar_upload_uses_token_uid_not_request_body(): void
    {
        $timestamp = '2026-08-06T00:00:00+00:00';

        $this->mock(FirebaseStorageService::class, function (MockInterface $mock) {
            $mock->shouldReceive('isConfigured')->once()->andReturn(true);
            $mock->shouldReceive('uploadProfileAvatar')
                ->once()
                ->with('firebase-uid-123', \Mockery::type(UploadedFile::class))
                ->andReturn('profile-images/firebase-uid-123/avatar.webp');
            $mock->shouldReceive('signedUrlForProfileAvatar')
                ->once()
                ->andReturn('https://storage.example/avatar.webp?signed=1');
        });

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($timestamp) {
            $mock->shouldReceive('updateAvatar')
                ->once()
                ->with(
                    'firebase-uid-123',
                    'user@example.com',
                    'profile-images/firebase-uid-123/avatar.webp',
                )
                ->andReturn([
                    'created' => false,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: 'テストユーザー',
                        avatarType: 'image',
                        avatarValue: 'profile-images/firebase-uid-123/avatar.webp',
                        createdAt: $timestamp,
                        updatedAt: $timestamp,
                    ),
                ]);
        });

        $response = $this->post('/api/profile/avatar', [
            'uid' => 'other-user',
            'avatar' => UploadedFile::fake()->image('avatar.webp', 100, 100)->size(100),
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.uid', 'firebase-uid-123')
            ->assertJsonPath('profile.avatarType', 'image')
            ->assertJsonPath('profile.avatarValue', 'profile-images/firebase-uid-123/avatar.webp')
            ->assertJsonPath('profile.avatarUrl', 'https://storage.example/avatar.webp?signed=1');
    }

    public function test_profile_get_includes_avatar_url_for_image_profile(): void
    {
        $timestamp = '2026-08-06T00:00:00+00:00';

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($timestamp) {
            $mock->shouldReceive('findByUid')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn(new UserProfileData(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    displayName: 'テストユーザー',
                    avatarType: 'image',
                    avatarValue: 'profile-images/firebase-uid-123/avatar.webp',
                    createdAt: $timestamp,
                    updatedAt: $timestamp,
                ));
        });

        $this->mock(FirebaseStorageService::class, function (MockInterface $mock) {
            $mock->shouldReceive('signedUrlForProfileAvatar')
                ->once()
                ->with('firebase-uid-123', 'profile-images/firebase-uid-123/avatar.webp')
                ->andReturn('https://storage.example/avatar.webp?signed=1');
        });

        $response = $this->getJson('/api/profile', [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.avatarUrl', 'https://storage.example/avatar.webp?signed=1');
    }

    public function test_profile_avatar_delete_clears_avatar(): void
    {
        $timestamp = '2026-08-06T00:00:00+00:00';

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($timestamp) {
            $mock->shouldReceive('findByUid')
                ->once()
                ->andReturn(new UserProfileData(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    displayName: 'テストユーザー',
                    avatarType: 'image',
                    avatarValue: 'profile-images/firebase-uid-123/avatar.webp',
                    createdAt: $timestamp,
                    updatedAt: $timestamp,
                ));
            $mock->shouldReceive('clearAvatar')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn([
                    'created' => false,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: 'テストユーザー',
                        avatarType: 'none',
                        avatarValue: '',
                        createdAt: $timestamp,
                        updatedAt: $timestamp,
                    ),
                ]);
        });

        $this->mock(FirebaseStorageService::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteProfileAvatar')
                ->once()
                ->with('firebase-uid-123', 'profile-images/firebase-uid-123/avatar.webp');
        });

        $response = $this->deleteJson('/api/profile/avatar', [], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.avatarType', 'none')
            ->assertJsonPath('profile.avatarValue', '');
    }

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->mock(\App\Services\FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->andReturn(new \App\Data\VerifiedFirebaseUser(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    emailVerified: false,
                ));
        });
    }
}
