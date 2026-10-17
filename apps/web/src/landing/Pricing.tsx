import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { IntervalToggle, PlanCard, PlanGrid } from '../billing/PlanCards';
import { PLANS } from '../billing/plans';
import type { Interval } from '../billing/subscription';
import { SectionTitle } from './SectionTitle';

/** Where "Contact us" for the Business plan goes. Set at launch; hidden until then. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

const FAQ: [string, string][] = [
  [
    'What counts as a customer check?',
    'Each time you check a customer, from a new booking or on its own. Adding notes, reporting incidents and opening alerts never count.',
  ],
  [
    'Do I need a card for the free trial?',
    'No. Every verified business gets 14 days of Pro, free. Add a card only if you choose a plan.',
  ],
  [
    'What happens when the trial ends?',
    'You move to Free automatically: 10 checks a month, nothing deleted. Upgrade whenever you like.',
  ],
  [
    'Can I cancel anytime?',
    'Yes. Cancel in Plan and billing. Your plan lasts until the end of the period you paid for.',
  ],
];

function planAction(tier: string) {
  if (tier === 'free') {
    return (
      <Button component={RouterLink} to="/sign-up" variant="outlined">
        Start free
      </Button>
    );
  }
  if (tier === 'business') {
    return CONTACT_EMAIL ? (
      <Button
        component="a"
        href={`mailto:${CONTACT_EMAIL}?subject=ClientShield%20Business%20plan`}
        variant="outlined"
      >
        Contact us
      </Button>
    ) : null;
  }
  return (
    <Button
      component={RouterLink}
      to="/sign-up"
      variant={tier === 'pro' ? 'contained' : 'outlined'}
    >
      Start 14-day free trial
    </Button>
  );
}

export function Pricing() {
  const [interval, setInterval] = useState<Interval>('month');
  return (
    <Box
      component="section"
      id="pricing"
      aria-labelledby="pricing-title"
      sx={{ py: { xs: 8, md: 12 }, scrollMarginTop: 16 }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' } }}
        >
          <SectionTitle eyebrow="Pricing">
            <span id="pricing-title">Simple plans. Start free.</span>
          </SectionTitle>
          <Box sx={{ mb: { xs: 3, md: 6 } }}>
            <IntervalToggle value={interval} onChange={setInterval} />
          </Box>
        </Stack>
        <PlanGrid>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              interval={interval}
              badge={plan.tier === 'pro' ? 'Most popular' : undefined}
              highlight={plan.tier === 'pro'}
              action={planAction(plan.tier)}
            />
          ))}
        </PlanGrid>
        <Typography color="text.secondary" sx={{ mt: 3 }}>
          Every plan starts with a 14-day Pro trial when your business is verified. No card needed.
          Prices in US dollars. Cancel anytime.
        </Typography>

        <Box component="section" aria-labelledby="pricing-faq-title" sx={{ mt: { xs: 6, md: 8 } }}>
          <Typography id="pricing-faq-title" variant="h5" component="h3" sx={{ mb: 3 }}>
            Questions about pricing
          </Typography>
          <Grid container spacing={3} component="dl" sx={{ m: 0 }}>
            {FAQ.map(([question, answer]) => (
              <Grid key={question} size={{ xs: 12, md: 6 }}>
                <Typography component="dt" sx={{ fontWeight: 600 }}>
                  {question}
                </Typography>
                <Typography component="dd" color="text.secondary" sx={{ m: 0, mt: 0.5 }}>
                  {answer}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
