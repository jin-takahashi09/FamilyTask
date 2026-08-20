<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadProfileAvatarRequest extends FormRequest
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
            'avatar' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'max:5120',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'avatar.required' => '画像ファイルを選択してください',
            'avatar.image' => '画像ファイルを選択してください',
            'avatar.mimes' => 'JPEG、PNG、WebP形式の画像を選択してください',
            'avatar.max' => '画像サイズが大きすぎます',
        ];
    }
}
