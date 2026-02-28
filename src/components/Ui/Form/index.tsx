// src/components/Ui/Form.tsx
'use client';

import React, { forwardRef } from 'react';

interface FormProps {
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  svg?: React.ReactNode;
}

const Form = forwardRef<HTMLFormElement, FormProps>(({
  onSubmit,
  children,
  className,
  title,
  svg,
}, ref) => {
  return (
    <div className="flex flex-col">
      {title && (
        <h1 className="flex items-center gap-2 my-2 text-brand-logo text-[24px] font-poppins">
          {svg && svg}
          <span>{title}</span>
        </h1>
      )}
      <form
        ref={ref}
        onSubmit={onSubmit}
        className={className ? className : "flex flex-col gap-5"}
      >
        {children}
      </form>
    </div>
  );
});

Form.displayName = 'Form';

export default Form;