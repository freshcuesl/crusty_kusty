import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent, type ReactNode } from 'react';
import { CATEGORY_LABELS, formatUsPhone, normalizeUsPhone, type IncidentCategory } from '@cs/core';
import { FormError } from '../auth/ui';
import { US_STATES } from '../lib/usStates';

export interface IncidentPayload {
  p_category: IncidentCategory;
  p_service_date: string;
  p_service_type: string;
  p_invoice_number: string;
  p_description: string;
  p_customer: {
    full_name: string;
    phone: string;
    email: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postal_code: string;
  };
  p_review: { url: string; rating: number; date: string; text: string } | null;
}

export interface IncidentFormValues {
  category?: string;
  service_date?: string;
  service_type?: string;
  invoice_number?: string | null;
  description?: string;
  review_url?: string | null;
  review_rating?: number | null;
  review_date?: string | null;
  review_text?: string | null;
  customer?: {
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  } | null;
}

interface IncidentFormProps {
  initial?: IncidentFormValues;
  submitLabel: string;
  /** Saves the report; returns an error message to show, or null on success. */
  onSave: (payload: IncidentPayload) => Promise<string | null>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Paper>
  );
}

const nativeSelect = { select: { native: true }, inputLabel: { shrink: true } } as const;

/** The incident report form, used to start a report and to edit a draft. */
export function IncidentForm({ initial = {}, submitLabel, onSave }: IncidentFormProps) {
  const c = initial.customer ?? {};
  const [name, setName] = useState(c.full_name ?? '');
  const [phone, setPhone] = useState(c.phone ? formatUsPhone(c.phone) : '');
  const [email, setEmail] = useState(c.email ?? '');
  const [line1, setLine1] = useState(c.address_line1 ?? '');
  const [line2, setLine2] = useState(c.address_line2 ?? '');
  const [city, setCity] = useState(c.city ?? '');
  const [state, setState] = useState(c.state ?? '');
  const [zip, setZip] = useState(c.postal_code ?? '');
  const [serviceDate, setServiceDate] = useState(initial.service_date ?? '');
  const [serviceType, setServiceType] = useState(initial.service_type ?? '');
  const [invoice, setInvoice] = useState(initial.invoice_number ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [hasReview, setHasReview] = useState(Boolean(initial.review_url));
  const [reviewUrl, setReviewUrl] = useState(initial.review_url ?? '');
  const [reviewRating, setReviewRating] = useState(
    initial.review_rating ? String(initial.review_rating) : '',
  );
  const [reviewDate, setReviewDate] = useState(initial.review_date ?? '');
  const [reviewText, setReviewText] = useState(initial.review_text ?? '');
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
    if (!category) {
      setError('Choose what kind of dispute this was.');
      return;
    }
    setBusy(true);
    try {
      const message = await onSave({
        p_category: category as IncidentCategory,
        p_service_date: serviceDate,
        p_service_type: serviceType,
        p_invoice_number: invoice,
        p_description: description,
        p_customer: {
          full_name: name,
          phone: normalizedPhone,
          email,
          address_line1: line1,
          address_line2: line2,
          city,
          state,
          postal_code: zip,
        },
        p_review: hasReview
          ? {
              url: reviewUrl.trim(),
              rating: Number(reviewRating),
              date: reviewDate,
              text: reviewText,
            }
          : null,
      });
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={2.5}>
        <Group title="Customer">
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
              slotProps={nativeSelect}
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
          <Typography variant="body2" color="text.secondary">
            Give at least a phone, email or address. These details are only seen by your business
            and ClientShield moderators.
          </Typography>
        </Group>

        <Group title="The job">
          <TextField
            label="Date of service"
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Type of service"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="Carpet cleaning"
          />
          <TextField
            label="Invoice or job number (optional)"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
          />
        </Group>

        <Group title="The dispute">
          <TextField
            select
            label="What kind of dispute?"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            slotProps={nativeSelect}
          >
            <option value="">Choose</option>
            {(Object.keys(CATEGORY_LABELS) as IncidentCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABELS[k]}
              </option>
            ))}
          </TextField>
          <TextField
            label="What happened?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={4}
            helperText="Dates, what was agreed, what the customer did. Facts only."
          />
          <FormControlLabel
            control={
              <Checkbox checked={hasReview} onChange={(e) => setHasReview(e.target.checked)} />
            }
            label="A Google review is involved"
          />
          {hasReview && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label="Link to the review"
                value={reviewUrl}
                onChange={(e) => setReviewUrl(e.target.value)}
                placeholder="https://g.page/..."
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="Star rating"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(e.target.value)}
                  slotProps={nativeSelect}
                  sx={{ minWidth: 120 }}
                >
                  <option value="">Choose</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'star' : 'stars'}
                    </option>
                  ))}
                </TextField>
                <TextField
                  label="Review date"
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Review text (optional)"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                multiline
                minRows={2}
              />
            </Box>
          )}
        </Group>

        <FormError message={error} />
        <Button type="submit" variant="contained" size="large" loading={busy}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
