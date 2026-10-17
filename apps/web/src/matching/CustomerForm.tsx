import { Button, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { normalizeUsPhone } from '@cs/core';
import { FormError } from '../auth/ui';
import { US_STATES } from '../lib/usStates';

export interface CustomerPayload {
  full_name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
}

interface CustomerFormProps {
  submitLabel: string;
  /** Returns an error message to show, or null on success. */
  onSubmit: (customer: CustomerPayload) => Promise<string | null>;
}

/** Customer details the business already has from a booking. */
export function CustomerForm({ submitLabel, onSubmit }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedPhone = phone.trim() ? normalizeUsPhone(phone) : '';
    if (normalizedPhone === null) {
      setError('Enter a 10-digit US phone number for the customer, or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      const message = await onSubmit({
        full_name: name,
        phone: normalizedPhone,
        email,
        address_line1: line1,
        address_line2: line2,
        city,
        state,
        postal_code: zip,
      });
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={2}>
        <TextField label="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Customer phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(206) 555-0100"
        />
        <TextField
          label="Customer email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Street address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
        />
        <TextField
          label="Suite or unit (optional)"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
        />
        <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Stack direction="row" spacing={2}>
          <TextField
            select
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            sx={{ minWidth: 110 }}
          >
            <option value="">Choose</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </TextField>
          <TextField
            label="ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            fullWidth
          />
        </Stack>
        <FormError message={error} />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
