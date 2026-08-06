<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransferOwnershipRequest extends FormRequest
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
            'targetUserId' => [
                'required',
                'string',
                'min:1',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'targetUserId.required' => '移譲先ユーザーを指定してください',
            'targetUserId.min' => '移譲先ユーザーを指定してください',
        ];
    }

    public function validatedTargetUserId(): string
    {
        /** @var array{targetUserId: string} $validated */
        $validated = $this->validated();

        return trim($validated['targetUserId']);
    }
}
