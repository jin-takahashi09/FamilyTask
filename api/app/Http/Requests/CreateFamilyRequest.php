<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateFamilyRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'min:1',
                'max:50',
                'regex:/^[^\p{Cc}]+$/u',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => '家族名を入力してください',
            'name.min' => '家族名を入力してください',
            'name.max' => '家族名は50文字以内で入力してください',
            'name.regex' => '家族名に使用できない文字が含まれています',
        ];
    }

    public function validatedName(): string
    {
        /** @var array{name: string} $validated */
        $validated = $this->validated();

        return trim($validated['name']);
    }
}
