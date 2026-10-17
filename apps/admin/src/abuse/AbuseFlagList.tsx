import { Chip } from '@mui/material';
import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  ReferenceField,
  SelectInput,
  TextField,
  type RaRecord,
} from 'react-admin';
import { flagLabel } from './labels';

export function FlagStatusChip({ record }: { record: RaRecord }) {
  return record.resolved_at ? (
    <Chip size="small" label="Resolved" />
  ) : (
    <Chip size="small" label="Open" color="warning" />
  );
}

const filters = [
  <SelectInput
    key="status"
    source="resolved_at@is"
    label="Status"
    choices={[{ id: 'null', name: 'Open' }]}
    alwaysOn
  />,
];

export function AbuseFlagList() {
  return (
    <List title="Abuse flags" filters={filters} sort={{ field: 'created_at', order: 'DESC' }}>
      <Datagrid rowClick="show" bulkActionButtons={false}>
        <ReferenceField source="business_id" reference="businesses" label="Business" link={false}>
          <TextField source="name" />
        </ReferenceField>
        <FunctionField label="Flag" render={(record: RaRecord) => flagLabel(record.kind)} />
        <TextField source="detail" label="What was noticed" sortable={false} />
        <DateField source="created_at" label="Raised" showTime />
        <FunctionField
          label="Status"
          render={(record: RaRecord) => <FlagStatusChip record={record} />}
        />
      </Datagrid>
    </List>
  );
}
