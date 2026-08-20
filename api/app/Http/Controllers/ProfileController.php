<?php

namespace App\Http\Controllers;

use App\Exceptions\ProfileServiceException;
use App\Http\Requests\UploadProfileAvatarRequest;
use App\Http\Requests\UpsertProfileRequest;
use App\Services\FirebaseStorageService;
use App\Services\ProfilePresenter;
use App\Services\UserProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

class ProfileController extends Controller
{
    public function show(
        Request $request,
        UserProfileService $profiles,
        ProfilePresenter $presenter,
    ): JsonResponse {
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
            'profile' => $presenter->presentProfile($profile),
        ]);
    }

    public function upsert(
        UpsertProfileRequest $request,
        UserProfileService $profiles,
        ProfilePresenter $presenter,
    ): JsonResponse {
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
            'profile' => $presenter->presentProfile($profile),
        ], $result['created'] ? 201 : 200);
    }

    public function uploadAvatar(
        UploadProfileAvatarRequest $request,
        UserProfileService $profiles,
        FirebaseStorageService $storage,
        ProfilePresenter $presenter,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');
        $email = (string) ($request->attributes->get('firebase_email') ?? '');

        if (! $storage->isConfigured()) {
            return response()->json([
                'message' => 'プロフィール画像を保存できませんでした',
            ], 503);
        }

        try {
            $path = $storage->uploadProfileAvatar($uid, $request->file('avatar'));
            $result = $profiles->updateAvatar($uid, $email, $path);
        } catch (ProfileServiceException) {
            return response()->json([
                'message' => 'プロフィール画像を保存できませんでした',
            ], 503);
        } catch (InvalidArgumentException) {
            return response()->json([
                'message' => '画像ファイルが不正です',
            ], 422);
        } catch (Throwable) {
            return response()->json([
                'message' => 'プロフィール画像を保存できませんでした',
            ], 503);
        }

        /** @var \App\Data\UserProfileData $profile */
        $profile = $result['profile'];

        return response()->json([
            'profile' => $presenter->presentProfile($profile),
        ]);
    }

    public function deleteAvatar(
        Request $request,
        UserProfileService $profiles,
        FirebaseStorageService $storage,
        ProfilePresenter $presenter,
    ): JsonResponse {
        $uid = (string) $request->attributes->get('firebase_uid');

        try {
            $existing = $profiles->findByUid($uid);

            if ($existing !== null && $existing->avatarType === 'image' && $existing->avatarValue !== '') {
                $storage->deleteProfileAvatar($uid, $existing->avatarValue);
            }

            $result = $profiles->clearAvatar($uid);
        } catch (ProfileServiceException) {
            return response()->json([
                'message' => 'プロフィール画像を削除できませんでした',
            ], 503);
        }

        /** @var \App\Data\UserProfileData $profile */
        $profile = $result['profile'];

        return response()->json([
            'profile' => $presenter->presentProfile($profile),
        ]);
    }
}
