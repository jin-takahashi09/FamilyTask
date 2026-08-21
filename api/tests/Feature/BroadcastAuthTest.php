<?php

namespace Tests\Feature;

use App\Data\VerifiedFirebaseUser;
use App\Services\FirebaseAuthService;
use App\Services\MembershipService;
use Illuminate\Support\Facades\Broadcast;
use Mockery\MockInterface;
use Tests\TestCase;

class BroadcastAuthTest extends TestCase
{
    private const CHANNEL = 'private-family.family-1';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app-id',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
            'broadcasting.connections.reverb.options.port' => 8080,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);

        Broadcast::purge('reverb');
        Broadcast::purge('null');
        require base_path('routes/channels.php');

        $this->mock(FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->andReturn(new VerifiedFirebaseUser(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    emailVerified: false,
                ));
        });
    }

    public function test_broadcast_auth_requires_authentication(): void
    {
        $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => self::CHANNEL,
        ])->assertUnauthorized()
            ->assertJson(['message' => '認証が必要です']);
    }

    public function test_broadcast_auth_rejects_non_member(): void
    {
        $this->mock(MembershipService::class, function (MockInterface $mock) {
            $mock->shouldReceive('isMember')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andReturn(false);
        });

        $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => self::CHANNEL,
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_broadcast_auth_allows_member(): void
    {
        $this->mock(MembershipService::class, function (MockInterface $mock) {
            $mock->shouldReceive('isMember')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andReturn(true);
        });

        $response = $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => self::CHANNEL,
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response->assertOk();
        $this->assertArrayHasKey('auth', $response->json());
    }

    public function test_broadcast_auth_uses_authenticated_uid_not_request_body(): void
    {
        $this->mock(MembershipService::class, function (MockInterface $mock) {
            $mock->shouldReceive('isMember')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andReturn(true);
        });

        $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => self::CHANNEL,
            'user_id' => 'attacker-uid',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_user_notification_channel_allows_own_uid(): void
    {
        $response = $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => 'private-user.firebase-uid-123',
        ], [
            'Authorization' => 'Bearer valid-token',
        ]);

        $response->assertOk();
        $this->assertArrayHasKey('auth', $response->json());
    }

    public function test_user_notification_channel_rejects_other_uid(): void
    {
        $this->post('/api/broadcasting/auth', [
            'socket_id' => '1.1',
            'channel_name' => 'private-user.other-user',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }
}
