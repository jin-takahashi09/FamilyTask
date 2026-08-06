<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpsertProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'displayName' => [
                'required',
                'string',
                'min:1',
                'max:50',
                'regex:/^[^\p{Cc}]+$/u',
            ],
            'avatarType' => [
                'required',
                'string',
                Rule::in(['none', 'initials']),
            ],
            'avatarValue' => [
                'nullable',
                'string',
                'max:64',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'displayName.required' => '表示名を入力してください',
            'displayName.min' => '表示名を入力してください',
            'displayName.max' => '表示名は50文字以内で入力してください',
            'displayName.regex' => '表示名に使用できない文字が含まれています',
            'avatarType.in' => 'アバター形式が不正です',
            'avatarValue.max' => 'アバター値が長すぎます',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $avatarValue = (string) ($this->input('avatarValue') ?? '');

            if ($avatarValue === '') {
                return;
            }

            if (str_starts_with(strtolower($avatarValue), 'data:image')) {
                $validator->errors()->add(
                    'avatarValue',
                    '画像データはFirestoreへ保存できません',
                );
            }

            if (strlen($avatarValue) > 256) {
                $validator->errors()->add(
                    'avatarValue',
                    'アバター値が長すぎます',
                );
            }
        });
    }

    /**
     * @return array{displayName: string, avatarType: string, avatarValue: string}
     */
    public function validatedProfile(): array
    {
        /** @var array{displayName: string, avatarType: string, avatarValue?: string|null} $validated */
        $validated = $this->validated();

        return [
            'displayName' => trim($validated['displayName']),
            'avatarType' => $validated['avatarType'],
            'avatarValue' => trim((string) ($validated['avatarValue'] ?? '')),
        ];
    }
}
