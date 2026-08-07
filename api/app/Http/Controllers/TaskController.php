<?php

namespace App\Http\Controllers;

use App\Exceptions\TaskServiceException;
use App\Services\TaskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request, string $familyId, TaskService $tasks): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        $date = $request->query('date');
        $assigneeId = $request->query('assigneeId');
        $completed = $request->query('completed');

        $completedFilter = null;
        if ($completed !== null) {
            $completedFilter = filter_var($completed, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        try {
            $items = $tasks->listForFamily(
                $uid,
                $familyId,
                is_string($date) && $date !== '' ? $date : null,
                is_string($assigneeId) && $assigneeId !== '' ? $assigneeId : null,
                $completedFilter,
            );
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'tasks' => array_map(static fn ($task) => $task->toArray(), $items),
        ]);
    }

    public function store(Request $request, string $familyId, TaskService $tasks): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $created = $tasks->create($uid, $familyId, $request->all());
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'tasks' => array_map(static fn ($task) => $task->toArray(), $created),
        ], 201);
    }

    public function show(
        Request $request,
        string $familyId,
        string $taskId,
        TaskService $tasks,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $task = $tasks->getForMember($uid, $familyId, $taskId);
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'task' => $task->toArray(),
        ]);
    }

    public function update(
        Request $request,
        string $familyId,
        string $taskId,
        TaskService $tasks,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $task = $tasks->update($uid, $familyId, $taskId, $request->all());
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'task' => $task->toArray(),
        ]);
    }

    public function complete(
        Request $request,
        string $familyId,
        string $taskId,
        TaskService $tasks,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        $completed = filter_var($request->input('completed'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($completed === null) {
            return response()->json(['message' => '完了状態が不正です'], 422);
        }

        try {
            $task = $tasks->setCompleted($uid, $familyId, $taskId, $completed);
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'task' => $task->toArray(),
        ]);
    }

    public function destroy(
        Request $request,
        string $familyId,
        string $taskId,
        TaskService $tasks,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $tasks->delete($uid, $familyId, $taskId);
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'message' => 'タスクを削除しました',
        ]);
    }

    public function destroyRecurrence(
        Request $request,
        string $familyId,
        string $recurrenceGroupId,
        TaskService $tasks,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $tasks->deleteRecurrence($uid, $familyId, $recurrenceGroupId, $request->all());
        } catch (TaskServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'message' => 'タスクを削除しました',
        ]);
    }

    private function serviceError(TaskServiceException $exception): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
        ], $exception->statusCode);
    }
}
