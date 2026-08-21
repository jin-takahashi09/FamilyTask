<?php

namespace App\Http\Controllers;

use App\Exceptions\NotificationServiceException;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, NotificationService $notifications): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $items = $notifications->listForUser($uid);
        } catch (NotificationServiceException $e) {
            return $this->serviceError($e);
        }

        $unreadCount = count(array_filter(
            $items,
            static fn ($n): bool => $n->readAt === null,
        ));

        return response()->json([
            'notifications' => array_map(static fn ($n) => $n->toArray(), $items),
            'unreadCount' => $unreadCount,
        ]);
    }

    public function markRead(
        Request $request,
        string $id,
        NotificationService $notifications,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $notification = $notifications->markRead($uid, $id);
        } catch (NotificationServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'notification' => $notification->toArray(),
        ]);
    }

    public function markAllRead(Request $request, NotificationService $notifications): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $result = $notifications->markAllRead($uid);
        } catch (NotificationServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json($result);
    }

    private function serviceError(NotificationServiceException $exception): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
        ], $exception->statusCode);
    }
}
