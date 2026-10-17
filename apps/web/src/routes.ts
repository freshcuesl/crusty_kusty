import AddAlertOutlined from '@mui/icons-material/AddAlertOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import type { SvgIconComponent } from '@mui/icons-material';

export interface HomeAction {
  label: string;
  description: string;
  path: string;
  icon: SvgIconComponent;
  primary?: boolean;
  /** Only verified businesses may use it (it reads or writes the shared incident network). */
  needsVerification?: boolean;
}

/** The main screen actions from the product spec, in order. */
export const homeActions: HomeAction[] = [
  {
    label: 'New customer',
    description: 'Add a booking and check it automatically',
    path: '/customers/new',
    icon: PersonAddAlt1Outlined,
    primary: true,
    needsVerification: true,
  },
  {
    label: 'Report incident',
    description: 'Document a dispute with evidence',
    path: '/incidents/new',
    icon: AddAlertOutlined,
    needsVerification: true,
  },
  {
    label: 'Customer check',
    description: 'Check a customer you already have',
    path: '/check',
    icon: VerifiedUserOutlined,
    needsVerification: true,
  },
  {
    label: 'Customers',
    description: 'Saved customers and private notes',
    path: '/customers',
    icon: PeopleOutlined,
  },
  {
    label: 'My incidents',
    description: 'Track reports and their status',
    path: '/incidents',
    icon: FolderOpenOutlined,
  },
  {
    label: 'Alerts',
    description: 'Matches on your customers',
    path: '/alerts',
    icon: NotificationsOutlined,
  },
];
