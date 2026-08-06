<?php

namespace App\Services;

use Google\Cloud\Firestore\FirestoreClient;

class InviteCodeGenerator
{
    private const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const DEFAULT_LENGTH = 6;

    public function __construct(
        private readonly FirestoreService $firestore,
    ) {}

    public function generateUnique(FirestoreClient $client): string
    {
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = $this->generate(self::DEFAULT_LENGTH);
            if (! $this->exists($client, $code)) {
                return $code;
            }
        }

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = $this->generate(8);
            if (! $this->exists($client, $code)) {
                return $code;
            }
        }

        throw new \RuntimeException('Failed to generate a unique invite code.');
    }

    public function generate(int $length = self::DEFAULT_LENGTH): string
    {
        $maxIndex = strlen(self::CHARS) - 1;
        $code = '';

        for ($i = 0; $i < $length; $i++) {
            $code .= self::CHARS[random_int(0, $maxIndex)];
        }

        return $code;
    }

    private function exists(FirestoreClient $client, string $code): bool
    {
        foreach (
            $client->collection('families')
                ->where('inviteCode', '=', $code)
                ->limit(1)
                ->documents() as $document
        ) {
            if ($document->exists()) {
                return true;
            }
        }

        return false;
    }
}
