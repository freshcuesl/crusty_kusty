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
import {
  CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  type IncidentCategory,
  type IncidentStatus,
} from '@cs/core';

const STATUS_COLORS: Record<IncidentStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> =
  {
    draft: 'default',
    submitted: 'info',
    needs_info: 'warning',
    evidence_verified: 'success',
    rejected: 'error',
    expired: 'default',
  };

export function IncidentStatusChip({ status }: { status: IncidentStatus }) {
  return (
    <Chip
      size="small"
      label={INCIDENT_STATUS_LABELS[status] ?? status}
      color={STATUS_COLORS[status]}
    />
  );
}

const filters = [
  <SelectInput
    key="status"
    source="status"
    label="Status"
    choices={Object.entries(INCIDENT_STATUS_LABELS).map(([id, name]) => ({ id, name }))}
    alwaysOn
  />,
];

export function IncidentList() {
  return (
    <List
      title="Incident review"
      filters={filters}
      filterDefaultValues={{ status: 'submitted' }}
      sort={{ field: 'submitted_at', order: 'ASC' }}
    >
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <FunctionField
          label="Dispute"
          render={(record: RaRecord) => CATEGORY_LABELS[record.category as IncidentCategory]}
        />
        <TextField source="service_type" label="Service" />
        <FunctionField
          label="Status"
          render={(record: RaRecord) => (
            <IncidentStatusChip status={record.status as IncidentStatus} />
          )}
        />
        <DateField source="submitted_at" label="Submitted" showTime />
      </Datagrid>
    </List>
  );
}
