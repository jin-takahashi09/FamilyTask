<?php

namespace Tests\Unit;

use App\Services\FirestoreRetry;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class FirestoreRetryTest extends TestCase
{
    public function test_retries_transient_failures(): void
    {
        $attempts = 0;

        $result = FirestoreRetry::run(function () use (&$attempts): string {
            $attempts++;

            if ($attempts < 2) {
                throw new RuntimeException('gRPC deadline exceeded');
            }

            return 'ok';
        });

        $this->assertSame('ok', $result);
        $this->assertSame(2, $attempts);
    }

    public function test_does_not_retry_non_transient_failures(): void
    {
        $attempts = 0;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('permission denied');

        FirestoreRetry::run(function () use (&$attempts): void {
            $attempts++;
            throw new RuntimeException('permission denied');
        });

        $this->assertSame(1, $attempts);
    }
}
