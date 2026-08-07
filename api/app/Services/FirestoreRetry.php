<?php

namespace App\Services;

use Throwable;

/**
 * Retries transient Firestore/gRPC failures (deadline exceeded, unavailable, etc.).
 */
class FirestoreRetry
{
    private const MAX_ATTEMPTS = 3;

    /** @var list<string> */
    private const RETRYABLE_FRAGMENTS = [
        'deadline exceeded',
        'unavailable',
        'resource_exhausted',
        'connection reset',
        'transport closed',
    ];

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function run(callable $callback, ?FirestoreService $firestore = null): mixed
    {
        $lastException = null;

        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; $attempt++) {
            try {
                return $callback();
            } catch (Throwable $exception) {
                $lastException = $exception;

                if ($attempt >= self::MAX_ATTEMPTS || ! self::isRetryable($exception)) {
                    throw $exception;
                }

                $firestore?->resetClient();
                usleep(100_000 * $attempt);
            }
        }

        throw $lastException ?? new \RuntimeException('Firestore retry failed');
    }

    public static function isRetryable(Throwable $exception): bool
    {
        $message = strtolower($exception->getMessage());

        foreach (self::RETRYABLE_FRAGMENTS as $fragment) {
            if (str_contains($message, $fragment)) {
                return true;
            }
        }

        return false;
    }
}
