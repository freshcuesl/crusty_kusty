import { useEffect } from 'react';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import GppGoodOutlined from '@mui/icons-material/GppGoodOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { loadWebAnalytics } from './webAnalytics';
import { Link as RouterLink } from 'react-router';
import { brand, fonts, Logo } from '@cs/brand';

// The hero and footer always use the dark brand look, whatever the device theme.
const onMidnight = { bgcolor: brand.midnight, color: brand.mist } as const;

function SiteHeader() {
  return (
    <Box component="header" sx={{ ...onMidnight, pt: 'env(safe-area-inset-top)' }}>
      <Container
        maxWidth="lg"
        component="nav"
        aria-label="Site"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}
      >
        <RouterLink
          to="/"
          aria-label="ClientShield home"
          style={{ color: 'inherit', display: 'inline-flex', textDecoration: 'none' }}
        >
          <Logo size={34} withWordmark onDark decorative />
        </RouterLink>
        <Box sx={{ flex: 1 }} />
        <Button component={RouterLink} to="/sign-in" sx={{ color: brand.mist }}>
          Sign in
        </Button>
        <Button
          component={RouterLink}
          to="/sign-up"
          variant="contained"
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          Get started
        </Button>
      </Container>
    </Box>
  );
}

function AlertMockup() {
  const rows: [string, string][] = [
    ['Contractor', 'Verified business'],
    ['Date', 'August 2026'],
    ['Complaint', 'Google 1-star review'],
    ['Evidence submitted', '7 items'],
    ['Customer response', 'Disputed'],
  ];
  return (
    <Box
      component="figure"
      aria-label="Example alert on a phone"
      sx={{
        m: 0,
        mx: 'auto',
        width: '100%',
        maxWidth: 330,
        p: 1.25,
        borderRadius: '38px',
        bgcolor: '#050E1C',
        border: `1px solid ${brand.midnightSoft}`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}
    >
      <Box
        sx={{
          borderRadius: '30px',
          overflow: 'hidden',
          bgcolor: brand.mist,
          color: brand.midnight,
        }}
      >
        <Box sx={{ ...onMidnight, px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Logo size={22} withWordmark onDark decorative />
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" sx={{ color: brand.slate }}>
            New booking · John S. · 123 Main St
          </Typography>
          <Box
            sx={{
              mt: 1,
              p: 2,
              borderRadius: 3,
              bgcolor: '#FDF1DF',
              border: `1px solid ${brand.amber}`,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <WarningAmberOutlined sx={{ color: '#8A5A00' }} aria-hidden="true" />
              <Typography sx={{ fontWeight: 700 }}>Verified incident found</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: brand.slate, mb: 1.5 }}>
              Customer information matches a previous service dispute.
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              1 verified incident
            </Typography>
            <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.5 }}>
              {rows.map(([term, value]) => (
                <Box key={term} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography component="dt" variant="body2" sx={{ color: brand.slate }}>
                    {term}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Box
              component="span"
              sx={{
                flex: 1,
                textAlign: 'center',
                py: 1,
                borderRadius: 2,
                bgcolor: brand.teal,
                color: brand.midnight,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Review incident
            </Box>
            <Box
              component="span"
              sx={{
                flex: 1,
                textAlign: 'center',
                py: 1,
                borderRadius: 2,
                border: `1px solid ${brand.midnight}`,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Continue booking
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function Hero() {
  return (
    <Box
      component="section"
      aria-labelledby="hero-title"
      sx={{
        ...onMidnight,
        position: 'relative',
        overflow: 'hidden',
        pb: { xs: 8, md: 12 },
        pt: { xs: 4, md: 8 },
        // A soft teal glow behind the phone.
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 640,
          height: 640,
          right: { xs: -320, md: -120 },
          top: { xs: 260, md: -80 },
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brand.teal}33 0%, transparent 65%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Grid container spacing={{ xs: 6, md: 8 }} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography
              variant="overline"
              sx={{ color: brand.teal, fontWeight: 700, letterSpacing: '0.12em' }}
            >
              For service businesses
            </Typography>
            <Typography
              id="hero-title"
              component="h1"
              sx={{
                fontFamily: fonts.display,
                fontWeight: 800,
                fontSize: { xs: 44, sm: 56, md: 68 },
                lineHeight: 1.02,
                letterSpacing: '-0.03em',
                mt: 1,
              }}
            >
              Know before you go.
            </Typography>
            <Typography
              sx={{ mt: 3, fontSize: { xs: 18, md: 20 }, color: brand.haze, maxWidth: 560 }}
            >
              ClientShield privately alerts you when a new customer matches a verified service
              dispute — documented with evidence and confirmed by real people.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
              <Button component={RouterLink} to="/sign-up" variant="contained" size="large">
                Get started free
              </Button>
              <Button
                href="#how-it-works"
                size="large"
                variant="outlined"
                sx={{ color: brand.mist, borderColor: `${brand.mist}66` }}
              >
                See how it works
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <AlertMockup />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

const principles: [SvgIconComponent, string][] = [
  [LockOutlined, 'Two-step login for everyone'],
  [VerifiedUserOutlined, 'ID-verified business owners'],
  [FactCheckOutlined, 'Evidence reviewed by people'],
  [GppGoodOutlined, 'Private by design'],
];

function Principles() {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box
          component="ul"
          aria-label="Principles"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            py: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {principles.map(([Icon, text]) => (
            <Box component="li" key={text} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Icon sx={{ color: 'primary.dark' }} aria-hidden="true" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {text}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth: 640 }}>
      <Typography
        variant="overline"
        sx={{ color: 'primary.dark', fontWeight: 700, letterSpacing: '0.12em' }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h2"
        component="h2"
        sx={{ fontSize: { xs: 32, md: 42 }, letterSpacing: '-0.02em', mt: 0.5 }}
      >
        {children}
      </Typography>
    </Box>
  );
}

const steps: [SvgIconComponent, string, string][] = [
  [
    StorefrontOutlined,
    'Verify your business',
    'Business documents, an ID check for the owner and two-step login. No anonymous accounts.',
  ],
  [
    PhotoCameraOutlined,
    'Document disputes',
    'Invoices, photos, messages and timestamps. Every file is fingerprinted so it can’t be altered.',
  ],
  [
    FactCheckOutlined,
    'Moderators confirm the facts',
    'Real people confirm the job and the dispute happened. They never decide who was right.',
  ],
  [
    NotificationsActiveOutlined,
    'Get private alerts',
    'When a new booking matches a verified incident, only you are told — and you decide.',
  ],
];

function HowItWorks() {
  return (
    <Box
      component="section"
      id="how-it-works"
      aria-labelledby="how-title"
      sx={{ py: { xs: 8, md: 12 } }}
    >
      <Container maxWidth="lg">
        <SectionTitle eyebrow="How it works">
          <span id="how-title">From dispute to documented fact</span>
        </SectionTitle>
        <Box
          component="ol"
          aria-label="How it works"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 3,
          }}
        >
          {steps.map(([Icon, title, text], index) => (
            <Box
              component="li"
              key={title}
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: brand.midnight,
                    color: brand.teal,
                  }}
                >
                  <Icon aria-hidden="true" />
                </Box>
                <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  Step {index + 1}
                </Typography>
              </Stack>
              <Typography variant="h6" component="h3">
                {title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {text}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

const comparison: { blacklist: string; clientShield: string }[] = [
  { blacklist: 'Anyone can post anything', clientShield: 'Verified businesses only' },
  { blacklist: 'Opinions and labels', clientShield: 'Evidence reviewed by people' },
  { blacklist: 'Searchable by anyone', clientShield: 'No public people search' },
  { blacklist: 'Follows people forever', clientShield: 'Incidents expire after 24 or 60 months' },
];

function FactsNotLabels() {
  return (
    <Box
      component="section"
      aria-labelledby="facts-title"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}
    >
      <Container maxWidth="lg">
        <SectionTitle eyebrow="Not a blacklist">
          <span id="facts-title">Facts, not labels</span>
        </SectionTitle>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 3, borderRadius: 4, border: 1, borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                Review sites and blacklists
              </Typography>
              <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {comparison.map(({ blacklist }) => (
                  <Box component="li" key={blacklist} sx={{ display: 'flex', gap: 1 }}>
                    <CloseOutlined color="error" aria-hidden="true" />
                    <Typography>{blacklist}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                p: 3,
                borderRadius: 4,
                height: '100%',
                ...onMidnight,
              }}
            >
              <Typography variant="h6" component="h3" sx={{ mb: 2, color: brand.mist }}>
                ClientShield
              </Typography>
              <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {comparison.map(({ clientShield }) => (
                  <Box component="li" key={clientShield} sx={{ display: 'flex', gap: 1 }}>
                    <CheckCircleOutlined sx={{ color: brand.teal }} aria-hidden="true" />
                    <Typography>{clientShield}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function FinalCta() {
  return (
    <Box component="section" aria-labelledby="cta-title" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography
          id="cta-title"
          variant="h2"
          component="h2"
          sx={{ fontSize: { xs: 30, md: 42 }, letterSpacing: '-0.02em' }}
        >
          One avoided nightmare job pays for the whole year.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2, fontSize: 18 }}>
          Protect honest contractors. Protect honest customers. Verify the truth.
        </Typography>
        <Button
          component={RouterLink}
          to="/sign-up"
          variant="contained"
          size="large"
          sx={{ mt: 4, px: 5 }}
        >
          Create your free account
        </Button>
      </Container>
    </Box>
  );
}

function SiteFooter() {
  return (
    <Box
      component="footer"
      sx={{ ...onMidnight, py: 5, pb: 'calc(40px + env(safe-area-inset-bottom))' }}
    >
      <Container
        maxWidth="lg"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Logo size={28} withWordmark onDark />
        <Typography variant="body2" sx={{ color: brand.haze }}>
          Not a blacklist. A truth engine for the service industry. © {new Date().getFullYear()}{' '}
          ClientShield
        </Typography>
      </Container>
    </Box>
  );
}

/** Public home page for signed-out visitors. */
export function LandingPage() {
  useEffect(() => {
    loadWebAnalytics(import.meta.env.VITE_CF_ANALYTICS_TOKEN);
  }, []);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh' }}>
      <SiteHeader />
      <Box component="main" id="main">
        <Hero />
        <Principles />
        <HowItWorks />
        <FactsNotLabels />
        <FinalCta />
      </Box>
      <SiteFooter />
    </Box>
  );
}
