<?php

namespace App\Sync;

/**
 * Minimal event type identifiers for family-scoped realtime sync.
 */
final class FamilySyncEventType
{
    public const TaskCreated = 'task.created';

    public const TaskUpdated = 'task.updated';

    public const TaskCompleted = 'task.completed';

    public const TaskDeleted = 'task.deleted';

    public const FamilyCreated = 'family.created';

    public const FamilyJoined = 'family.joined';

    public const FamilyLeft = 'family.left';

    public const FamilyMemberRemoved = 'family.member_removed';

    public const FamilyDeleted = 'family.deleted';

    public const FamilyOwnershipTransferred = 'family.ownership_transferred';

    public const ProfileUpdated = 'profile.updated';

    private function __construct() {}
}
