<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeleteFamilyRequest extends FormRequest
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
            'confirmName' => [
                'required',
                'string',
                'min:1',
                'max:50',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'confirmName.required' => '確認のためグループ名を入力してください',
            'confirmName.min' => '確認のためグループ名を入力してください',
        ];
    }

    public function validatedConfirmName(): string
    {
        /** @var array{confirmName: string} $validated */
        $validated = $this->validated();

        return trim($validated['confirmName']);
    }
}
