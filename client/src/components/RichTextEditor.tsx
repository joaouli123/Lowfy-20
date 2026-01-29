
import { useEffect, useRef, useState, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (quillRef.current && mounted) {
      const editor = quillRef.current.getEditor();

      if (placeholder) {
        editor.root.dataset.placeholder = placeholder;
      }
    }
  }, [placeholder, mounted]);

  const modules = useMemo(() => ({
    toolbar: isFocused ? [
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ] : false,
  }), [isFocused]);

  const containerClass = isFocused ? 'rich-text-editor-focused' : 'rich-text-editor';

  const formats = useMemo(() => [
    'bold', 'italic', 'underline',
    'color',
    'list', 'bullet',
    'link'
  ], []);

  if (!mounted) {
    return (
      <div className={`${className} w-full min-h-[150px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800`}>
        <div className="p-3 text-gray-400 dark:text-gray-500">
          {placeholder || 'Carregando editor...'}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${containerClass} w-full`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
