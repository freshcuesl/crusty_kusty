import { Chip } from '@mui/material';
import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  SelectInput,
  TextField,
  type RaRecord,
} from 'react-admin';
import { STATUS_COLORS, STATUS_LABELS } from './labels';

const statusChoices = Object.entries(STATUS_LABELS).map(([id, name]) => ({ id, name }));

const filters = [
  <SelectInput
    key="status"
    source="verification_status"
    label="Status"
    choices={statusChoices}
    alwaysOn
  />,
];

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip size="small" label={STATUS_LABELS[status] ?? status} color={STATUS_COLORS[status]} />
  );
}

export function BusinessList() {
  return (
    <List
      title="Business verifications"
      filters={filters}
      filterDefaultValues={{ verification_status: 'pending' }}
      sort={{ field: 'submitted_at', order: 'ASC' }}
    >
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <TextField source="name" label="Business" />
        <FunctionField
          label="Status"
          render={(record: RaRecord) => <StatusChip status={String(record.verification_status)} />}
        />
        <DateField source="submitted_at" label="Submitted" showTime />
      </Datagrid>
    </List>
  );
}
