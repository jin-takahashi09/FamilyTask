<?php

namespace Tests\Feature;

use App\Data\VerifiedFirebaseUser;
use App\Exceptions\FirebaseAuthenticationException;
use App\Services\FirebaseAuthService;
use Mockery\MockInterface;
use Tests\TestCase;

class AuthMeTest extends TestCase
{
    public function test_auth_me_requires_authorization_header(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_auth_me_rejects_invalid_bearer_format(): void
    {
        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Token invalid',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_auth_me_rejects_empty_bearer_token(): void
    {
        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer ',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ]);
    }

    public function test_auth_me_rejects_invalid_token(): void
    {
        $this->mock(FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->once()
                ->with('invalid-token')
                ->andThrow(new FirebaseAuthenticationException('Invalid Firebase ID token.'));
        });

        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer invalid-token',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ])
            ->assertJsonMissing(['token']);
    }

    public function test_auth_me_returns_user_info_for_valid_token(): void
    {
        $this->mock(FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->once()
                ->with('valid-token')
                ->andReturn(new VerifiedFirebaseUser(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    emailVerified: false,
                ));
        });

        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response
            ->assertOk()
            ->assertExactJson([
                'uid' => 'firebase-uid-123',
                'email' => 'user@example.com',
                'emailVerified' => false,
            ])
            ->assertJsonMissing(['token']);
    }

    public function test_auth_me_does_not_expose_internal_exception_message(): void
    {
        $this->mock(FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->once()
                ->andThrow(new FirebaseAuthenticationException('secret internal path failure'));
        });

        $response = $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer broken-token',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJson([
                'message' => '認証が必要です',
            ])
            ->assertJsonMissing(['secret internal path failure']);
    }
}
