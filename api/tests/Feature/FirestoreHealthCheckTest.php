<?php

namespace Tests\Feature;

use App\Services\FirestoreService;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class FirestoreHealthCheckTest extends TestCase
{
    public function test_firestore_health_returns_connected_status(): void
    {
        $this->mock(FirestoreService::class, function (MockInterface $mock) {
            $mock->shouldReceive('checkConnection')->once();
        });

        $response = $this->getJson('/api/firestore/health');

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'firestore' => 'connected',
            ]);
    }

    public function test_firestore_health_returns_error_when_connection_fails(): void
    {
        $this->mock(FirestoreService::class, function (MockInterface $mock) {
            $mock->shouldReceive('checkConnection')
                ->once()
                ->andThrow(new RuntimeException('Firestore connection failed: permission denied'));
        });

        $response = $this->getJson('/api/firestore/health');

        $response
            ->assertStatus(503)
            ->assertJson([
                'status' => 'error',
                'message' => 'Firestore connection failed: permission denied',
            ]);
    }
}
