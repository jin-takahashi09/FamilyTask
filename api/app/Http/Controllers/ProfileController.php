<?php

namespace App\Http\Controllers;

use App\Exceptions\ProfileServiceException;
use App\Http\Requests\UpsertProfileRequest;
use App\Services\UserProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request, UserProfileService $profiles): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $profile = $profiles->findByUid($uid);
        } catch (ProfileServiceException) {
            return response()->json([
                'message' => 'プロフィールを取得できませんでした',
            ], 503);
        }

        if ($profile === null) {
            return response()->json([
                'message' => 'プロフィールが未設定です',
            ], 404);
        }

        return response()->json([
            'profile' => $profile->toArray(),
        ]);
    }

    public function upsert(UpsertProfileRequest $request, UserProfileService $profiles): JsonResponse
    {
        $uid = (string) $request->attributes->get('firebase_uid');
        $email = (string) ($request->attributes->get('firebase_email') ?? '');

        try {
            $result = $profiles->upsert($uid, $email, $request->validatedProfile());
        } catch (ProfileServiceException) {
            return response()->json([
                'message' => 'プロフィールを保存できませんでした',
            ], 503);
        }

        /** @var \App\Data\UserProfileData $profile */
        $profile = $result['profile'];

        return response()->json([
            'profile' => $profile->toArray(),
        ], $result['created'] ? 201 : 200);
    }
}
