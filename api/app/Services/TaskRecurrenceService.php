<?php

namespace App\Services;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;

class TaskRecurrenceService
{
    public const DEFAULT_MAX_RECURRING_MONTHS = 12;

    /**
     * @return list<string> YYYY-MM-DD date keys
     */
    public function generateRecurringDates(
        string $startDate,
        string $repeatType,
        ?string $repeatEndDate,
        ?int $repeatWeekday = null,
        int $maxMonths = self::DEFAULT_MAX_RECURRING_MONTHS,
    ): array {
        if ($repeatType === 'none') {
            return [$startDate];
        }

        $start = $this->parseDateKey($startDate);
        $endDateKey = $this->getEffectiveEndDate($startDate, $repeatEndDate, $maxMonths);
        $end = $this->parseDateKey($endDateKey);

        if ($start > $end) {
            return [];
        }

        return match ($repeatType) {
            'daily' => $this->generateDailyDates($start, $end),
            'weekly' => $this->generateWeeklyDates(
                $start,
                $end,
                $repeatWeekday ?? (int) $start->format('w'),
            ),
            'monthly' => $this->generateMonthlyDates($start, $end, (int) $start->format('j')),
            'yearly' => $this->generateYearlyDates($start, $end),
            default => [$startDate],
        };
    }

    public function validateRepeatEndDate(string $startDate, ?string $repeatEndDate): ?string
    {
        if ($repeatEndDate === null || $repeatEndDate === '') {
            return null;
        }

        $start = $this->parseDateKey($startDate);
        $end = $this->parseDateKey($repeatEndDate);

        if ($end < $start) {
            return '終了日は実施日以降を選択してください';
        }

        return null;
    }

    public function getEffectiveEndDate(
        string $startDate,
        ?string $repeatEndDate,
        int $maxMonths = self::DEFAULT_MAX_RECURRING_MONTHS,
    ): string {
        $start = $this->parseDateKey($startDate);
        $maxEnd = $start->add(new DateInterval('P'.$maxMonths.'M'));

        if ($repeatEndDate === null || $repeatEndDate === '') {
            return $this->toDateKey($maxEnd);
        }

        $end = $this->parseDateKey($repeatEndDate);

        if ($end > $maxEnd) {
            return $this->toDateKey($maxEnd);
        }

        return $repeatEndDate;
    }

    /**
     * @return list<string>
     */
    private function generateDailyDates(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $dates = [];
        $current = $start;

        while ($current <= $end) {
            $dates[] = $this->toDateKey($current);
            $current = $current->add(new DateInterval('P1D'));
        }

        return $dates;
    }

    /**
     * @return list<string>
     */
    private function generateWeeklyDates(
        DateTimeImmutable $start,
        DateTimeImmutable $end,
        int $targetWeekday,
    ): array {
        $dates = [];
        $current = $this->firstWeeklyOccurrence($start, $targetWeekday);

        while ($current <= $end) {
            $dates[] = $this->toDateKey($current);
            $current = $current->add(new DateInterval('P7D'));
        }

        return $dates;
    }

    /**
     * @return list<string>
     */
    private function generateMonthlyDates(
        DateTimeImmutable $start,
        DateTimeImmutable $end,
        int $anchorDay,
    ): array {
        $dates = [];
        $cursor = $start->modify('first day of this month');

        while ($cursor <= $end) {
            $lastDay = (int) $cursor->format('t');
            $day = min($anchorDay, $lastDay);
            $occurrence = $cursor->setDate(
                (int) $cursor->format('Y'),
                (int) $cursor->format('n'),
                $day,
            );

            if ($occurrence >= $start && $occurrence <= $end) {
                $dates[] = $this->toDateKey($occurrence);
            }

            $cursor = $cursor->add(new DateInterval('P1M'));
        }

        return $dates;
    }

    /**
     * @return list<string>
     */
    private function generateYearlyDates(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        $dates = [];
        $current = $start;

        while ($current <= $end) {
            $dates[] = $this->toDateKey($current);
            $current = $current->add(new DateInterval('P1Y'));
        }

        return $dates;
    }

    private function firstWeeklyOccurrence(DateTimeImmutable $start, int $targetWeekday): DateTimeImmutable
    {
        $startDay = (int) $start->format('w');
        $daysUntil = ($targetWeekday - $startDay + 7) % 7;

        return $start->add(new DateInterval('P'.$daysUntil.'D'));
    }

    private function parseDateKey(string $dateKey): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $dateKey, new DateTimeZone('UTC'));

        if ($date === false) {
            throw new \InvalidArgumentException('Invalid date key');
        }

        return $date;
    }

    private function toDateKey(DateTimeImmutable $date): string
    {
        return $date->format('Y-m-d');
    }
}
