<?php

namespace Tests\Feature;

use App\Data\UserProfileData;
use App\Exceptions\ProfileServiceException;
use App\Services\UserProfileService;
use Mockery\MockInterface;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    public function test_profile_get_requires_authentication(): void
    {
        $response = $this->getJson('/api/profile');

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_profile_put_requires_authentication(): void
    {
        $response = $this->putJson('/api/profile', [
            'displayName' => 'テスト',
            'avatarType' => 'none',
            'avatarValue' => '',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_profile_get_returns_not_found_when_missing(): void
    {
        $this->mock(UserProfileService::class, function (MockInterface $mock) {
            $mock->shouldReceive('findByUid')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn(null);
        });

        $response = $this->getJson('/api/profile', [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertNotFound()
            ->assertJson([
                'message' => 'プロフィールが未設定です',
            ]);
    }

    public function test_profile_put_creates_profile(): void
    {
        $createdAt = '2026-08-06T00:00:00+00:00';
        $updatedAt = '2026-08-06T00:00:00+00:00';

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($createdAt, $updatedAt) {
            $mock->shouldReceive('upsert')
                ->once()
                ->with(
                    'firebase-uid-123',
                    'user@example.com',
                    [
                        'displayName' => 'テストユーザー',
                        'avatarType' => 'none',
                        'avatarValue' => '',
                    ],
                )
                ->andReturn([
                    'created' => true,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: 'テストユーザー',
                        avatarType: 'none',
                        avatarValue: '',
                        createdAt: $createdAt,
                        updatedAt: $updatedAt,
                    ),
                ]);
        });

        $response = $this->putJson('/api/profile', [
            'displayName' => 'テストユーザー',
            'avatarType' => 'none',
            'avatarValue' => '',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('profile.uid', 'firebase-uid-123')
            ->assertJsonPath('profile.email', 'user@example.com')
            ->assertJsonPath('profile.displayName', 'テストユーザー');
    }

    public function test_profile_get_returns_existing_profile(): void
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
                    avatarType: 'none',
                    avatarValue: '',
                    createdAt: $timestamp,
                    updatedAt: $timestamp,
                ));
        });

        $response = $this->getJson('/api/profile', [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.uid', 'firebase-uid-123')
            ->assertJsonMissing(['token']);
    }

    public function test_profile_put_updates_profile(): void
    {
        $createdAt = '2026-08-06T00:00:00+00:00';
        $updatedAt = '2026-08-06T01:00:00+00:00';

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($createdAt, $updatedAt) {
            $mock->shouldReceive('upsert')
                ->once()
                ->andReturn([
                    'created' => false,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: '更新後',
                        avatarType: 'none',
                        avatarValue: '',
                        createdAt: $createdAt,
                        updatedAt: $updatedAt,
                    ),
                ]);
        });

        $response = $this->putJson('/api/profile', [
            'displayName' => '更新後',
            'avatarType' => 'none',
            'avatarValue' => '',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.displayName', '更新後')
            ->assertJsonPath('profile.createdAt', $createdAt)
            ->assertJsonPath('profile.updatedAt', $updatedAt);
    }

    public function test_profile_put_keeps_created_at_on_update(): void
    {
        $createdAt = '2026-08-06T00:00:00+00:00';
        $updatedAt = '2026-08-06T02:00:00+00:00';

        $this->mock(UserProfileService::class, function (MockInterface $mock) use ($createdAt, $updatedAt) {
            $mock->shouldReceive('upsert')
                ->once()
                ->andReturn([
                    'created' => false,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: '更新後',
                        avatarType: 'none',
                        avatarValue: '',
                        createdAt: $createdAt,
                        updatedAt: $updatedAt,
                    ),
                ]);
        });

        $response = $this->putJson('/api/profile', [
            'displayName' => '更新後',
            'avatarType' => 'none',
            'avatarValue' => '',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('profile.createdAt', $createdAt)
            ->assertJsonPath('profile.updatedAt', $updatedAt);
    }

    public function test_profile_put_uses_token_uid_and_email_not_request_body(): void
    {
        $this->mock(UserProfileService::class, function (MockInterface $mock) {
            $mock->shouldReceive('upsert')
                ->once()
                ->withArgs(function (string $uid, string $email, array $payload) {
                    return $uid === 'firebase-uid-123'
                        && $email === 'user@example.com'
                        && ! array_key_exists('uid', $payload)
                        && ! array_key_exists('email', $payload);
                })
                ->andReturn([
                    'created' => true,
                    'profile' => new UserProfileData(
                        uid: 'firebase-uid-123',
                        email: 'user@example.com',
                        displayName: '本人',
                        avatarType: 'none',
                        avatarValue: '',
                        createdAt: '2026-08-06T00:00:00+00:00',
                        updatedAt: '2026-08-06T00:00:00+00:00',
                    ),
                ]);
        });

        $response = $this->putJson('/api/profile', [
            'uid' => 'other-user',
            'email' => 'attacker@example.com',
            'displayName' => '本人',
            'avatarType' => 'none',
            'avatarValue' => '',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('profile.uid', 'firebase-uid-123')
            ->assertJsonPath('profile.email', 'user@example.com');
    }

    public function test_profile_put_rejects_invalid_input(): void
    {
        $response = $this->putJson('/api/profile', [
            'displayName' => '',
            'avatarType' => 'image',
            'avatarValue' => str_repeat('a', 300),
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response->assertUnprocessable();
    }

    public function test_profile_put_rejects_base64_avatar_value(): void
    {
        $response = $this->putJson('/api/profile', [
            'displayName' => 'テスト',
            'avatarType' => 'none',
            'avatarValue' => 'data:image/png;base64,abc',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response->assertUnprocessable();
    }

    public function test_profile_get_does_not_expose_internal_exception(): void
    {
        $this->mock(UserProfileService::class, function (MockInterface $mock) {
            $mock->shouldReceive('findByUid')
                ->once()
                ->andThrow(new ProfileServiceException('secret internal failure'));
        });

        $response = $this->getJson('/api/profile', [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertStatus(503)
            ->assertJson([
                'message' => 'プロフィールを取得できませんでした',
            ])
            ->assertJsonMissing(['secret internal failure']);
    }

    protected function setUp(): void
    {
        parent::setUp();

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
