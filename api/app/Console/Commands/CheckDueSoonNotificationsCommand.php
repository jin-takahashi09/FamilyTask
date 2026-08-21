<?php

namespace App\Console\Commands;

use App\Services\DueSoonNotificationChecker;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Console\Command;
use Throwable;

class CheckDueSoonNotificationsCommand extends Command
{
    protected $signature = 'notifications:check-due
                            {--at= : Asia/Tokyo datetime for local testing (Y-m-d H:i or Y-m-d H:i:s)}';

    protected $description = 'Create task.due_soon notifications for deadlines ~30 minutes away (Asia/Tokyo)';

    public function handle(DueSoonNotificationChecker $checker): int
    {
        try {
            $now = $this->resolveNow();
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Checking due-soon notifications at '.$now->format('Y-m-d H:i:s T'));

        $result = $checker->run($now);

        $this->line('Date keys: '.implode(', ', $result['dateKeys']));
        $this->line('Checked: '.$result['checked']);
        $this->line('Created: '.$result['created']);
        $this->line('Skipped: '.$result['skipped']);

        return self::SUCCESS;
    }

    private function resolveNow(): DateTimeImmutable
    {
        $at = $this->option('at');
        $tz = new DateTimeZone(DueSoonNotificationChecker::TIMEZONE);

        if (! is_string($at) || $at === '') {
            return new DateTimeImmutable('now', $tz);
        }

        foreach (['Y-m-d H:i:s', 'Y-m-d H:i'] as $format) {
            $parsed = DateTimeImmutable::createFromFormat('!'.$format, $at, $tz);
            if ($parsed instanceof DateTimeImmutable) {
                return $parsed;
            }
        }

        throw new \InvalidArgumentException(
            'Invalid --at value. Use "Y-m-d H:i" or "Y-m-d H:i:s" (Asia/Tokyo).',
        );
    }
}
