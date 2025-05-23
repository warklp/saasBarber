"use client";

import * as React from "react";
import { Input, InputProps } from "./input";

export interface PhoneInputProps extends Omit<InputProps, "onChange"> {
  onChange?: (value: string) => void;
  value?: string;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ onChange, value, ...props }, ref) => {
    // Função para formatar números de telefone como (XX) XXXXX-XXXX
    const formatPhoneNumber = (value: string) => {
      // Remove todos os caracteres não numéricos
      const numbersOnly = value.replace(/\D/g, "");
      
      // Aplica a formatação
      if (numbersOnly.length <= 2) {
        return numbersOnly;
      } else if (numbersOnly.length <= 7) {
        return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2)}`;
      } else {
        return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(
          2,
          7
        )}-${numbersOnly.slice(7, 11)}`;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formattedValue = formatPhoneNumber(e.target.value);
      e.target.value = formattedValue;
      onChange?.(formattedValue);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        value={value}
        onChange={handleChange}
        maxLength={15} // (XX) XXXXX-XXXX tem 15 caracteres no máximo
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput"; 