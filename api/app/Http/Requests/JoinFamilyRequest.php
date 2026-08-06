<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class JoinFamilyRequest extends FormRequest
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
            'inviteCode' => [
                'required',
                'string',
                'min:6',
                'max:8',
                'regex:/^[A-Z0-9]+$/',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'inviteCode.required' => '招待コードを入力してください',
            'inviteCode.size' => '招待コードの形式が正しくありません',
            'inviteCode.regex' => '招待コードの形式が正しくありません',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('inviteCode')) {
            $this->merge([
                'inviteCode' => strtoupper(trim((string) $this->input('inviteCode'))),
            ]);
        }
    }

    public function validatedInviteCode(): string
    {
        /** @var array{inviteCode: string} $validated */
        $validated = $this->validated();

        return $validated['inviteCode'];
    }
}
