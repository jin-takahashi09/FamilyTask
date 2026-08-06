<?php

namespace App\Services;

use Google\Cloud\Firestore\FirestoreClient;
use RuntimeException;
use Throwable;

class FirestoreService
{
    private ?FirestoreClient $client = null;

    public function isConfigured(): bool
    {
        $path = $this->credentialsPath();

        return $path !== null && is_readable($path);
    }

    public function credentialsPath(): ?string
    {
        $path = env('GOOGLE_APPLICATION_CREDENTIALS');

        if (! is_string($path) || $path === '') {
            return null;
        }

        return $path;
    }

    public function getClient(): FirestoreClient
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Firestore credentials are not configured.');
        }

        if ($this->client === null) {
            try {
                $this->client = new FirestoreClient([
                    'keyFilePath' => $this->credentialsPath(),
                ]);
            } catch (Throwable $e) {
                throw new RuntimeException(
                    'Failed to initialize Firestore client: '.$e->getMessage(),
                    0,
                    $e,
                );
            }
        }

        return $this->client;
    }

    /**
     * Verify connectivity with a read-only query (no writes).
     */
    public function checkConnection(): void
    {
        try {
            $client = $this->getClient();

            foreach ($client->collection('_familytask_health')->limit(1)->documents() as $_document) {
                return;
            }
        } catch (Throwable $e) {
            throw new RuntimeException(
                'Firestore connection failed: '.$e->getMessage(),
                0,
                $e,
            );
        }
    }
}
