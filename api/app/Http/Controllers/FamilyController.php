<?php

namespace App\Http\Controllers;

use App\Exceptions\FamilyServiceException;
use App\Http\Requests\CreateFamilyRequest;
use App\Http\Requests\DeleteFamilyRequest;
use App\Http\Requests\JoinFamilyRequest;
use App\Http\Requests\TransferOwnershipRequest;
use App\Services\FamilyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilyController extends Controller
{
    public function index(Request $request, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $items = $families->listForUser($uid);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'families' => array_map(static fn ($family) => $family->toArray(), $items),
        ]);
    }

    public function store(CreateFamilyRequest $request, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $family = $families->create($uid, $request->validatedName());
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'family' => $family->toArray(),
        ], 201);
    }

    public function join(JoinFamilyRequest $request, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $family = $families->join($uid, $request->validatedInviteCode());
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'family' => $family->toArray(),
        ]);
    }

    public function show(Request $request, string $familyId, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $family = $families->getForMember($uid, $familyId);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'family' => $family->toArray(),
        ]);
    }

    public function members(Request $request, string $familyId, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $members = $families->listMembers($uid, $familyId);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'members' => array_map(static fn ($member) => $member->toArray(), $members),
        ]);
    }

    public function leave(Request $request, string $familyId, FamilyService $families): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $families->leave($uid, $familyId);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'message' => 'グループから退出しました',
        ]);
    }

    public function removeMember(
        Request $request,
        string $familyId,
        string $userId,
        FamilyService $families,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $families->removeMember($uid, $familyId, $userId);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'message' => 'メンバーをグループから外しました',
        ]);
    }

    public function transferOwnership(
        TransferOwnershipRequest $request,
        string $familyId,
        FamilyService $families,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $family = $families->transferOwnership(
                $uid,
                $familyId,
                $request->validatedTargetUserId(),
            );
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'family' => $family->toArray(),
        ]);
    }

    public function destroy(
        DeleteFamilyRequest $request,
        string $familyId,
        FamilyService $families,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $families->delete($uid, $familyId, $request->validatedConfirmName());
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'message' => 'グループを削除しました',
        ]);
    }

    public function regenerateInviteCode(
        Request $request,
        string $familyId,
        FamilyService $families,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $family = $families->regenerateInviteCode($uid, $familyId);
        } catch (FamilyServiceException $e) {
            return $this->serviceError($e);
        }

        return response()->json([
            'family' => $family->toArray(),
        ]);
    }

    private function serviceError(FamilyServiceException $exception): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
        ], $exception->statusCode);
    }
}
