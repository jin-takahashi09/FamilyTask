<?php

namespace App\Exceptions;

use Exception;

class FamilyServiceException extends Exception
{
    public function __construct(
        string $message,
        public int $statusCode = 503,
    ) {
        parent::__construct($message);
    }
}
