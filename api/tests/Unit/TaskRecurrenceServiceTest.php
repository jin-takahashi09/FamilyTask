<?php

namespace Tests\Unit;

use App\Services\TaskRecurrenceService;
use PHPUnit\Framework\TestCase;

class TaskRecurrenceServiceTest extends TestCase
{
    private TaskRecurrenceService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new TaskRecurrenceService;
    }

    public function test_none_returns_single_date(): void
    {
        $dates = $this->service->generateRecurringDates('2026-08-05', 'none', null);

        $this->assertSame(['2026-08-05'], $dates);
    }

    public function test_daily_includes_end_date(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2026-08-05',
            'daily',
            '2026-08-10',
        );

        $this->assertSame(
            [
                '2026-08-05',
                '2026-08-06',
                '2026-08-07',
                '2026-08-08',
                '2026-08-09',
                '2026-08-10',
            ],
            $dates,
        );
    }

    public function test_weekly_uses_weekday(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2026-08-05',
            'weekly',
            '2026-08-19',
            3,
        );

        $this->assertSame(
            ['2026-08-05', '2026-08-12', '2026-08-19'],
            $dates,
        );
    }

    public function test_monthly_clamps_to_month_end(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2026-01-31',
            'monthly',
            '2026-04-30',
        );

        $this->assertSame(
            ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
            $dates,
        );
    }

    public function test_yearly_repeats_same_month_day(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2026-08-05',
            'yearly',
            '2027-08-05',
        );

        $this->assertSame(['2026-08-05', '2027-08-05'], $dates);
    }

    public function test_monthly_leap_year_feb_29(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2024-02-29',
            'monthly',
            '2024-03-31',
        );

        $this->assertSame(['2024-02-29', '2024-03-29'], $dates);
    }

    public function test_end_date_before_start_returns_empty(): void
    {
        $dates = $this->service->generateRecurringDates(
            '2026-08-10',
            'daily',
            '2026-08-05',
        );

        $this->assertSame([], $dates);
    }

    public function test_validate_repeat_end_date_rejects_before_start(): void
    {
        $message = $this->service->validateRepeatEndDate('2026-08-10', '2026-08-05');

        $this->assertSame('終了日は実施日以降を選択してください', $message);
    }

    public function test_effective_end_date_caps_at_twelve_months(): void
    {
        $effective = $this->service->getEffectiveEndDate('2026-01-01', '2030-01-01');

        $this->assertSame('2027-01-01', $effective);
    }
}
