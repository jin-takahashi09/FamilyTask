<?php

namespace App\Data;

class FirestoreTimestamps
{
    public static function toIso8601(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(\DateTimeInterface::ATOM);
        }

        if (is_object($value) && method_exists($value, 'get')) {
            /** @var \DateTimeInterface|null $dateTime */
            $dateTime = $value->get();

            if ($dateTime instanceof \DateTimeInterface) {
                return $dateTime->format(\DateTimeInterface::ATOM);
            }
        }

        if (is_string($value) && $value !== '') {
            return $value;
        }

        return now()->toIso8601String();
    }
}
