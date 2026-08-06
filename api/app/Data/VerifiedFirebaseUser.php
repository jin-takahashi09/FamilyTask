<?php

namespace App\Data;

readonly class VerifiedFirebaseUser
{
    public function __construct(
        public string $uid,
        public ?string $email,
        public bool $emailVerified,
    ) {}
}
