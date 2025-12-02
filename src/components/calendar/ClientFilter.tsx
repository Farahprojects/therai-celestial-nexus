
import React from "react";

type Client = { id: string; name: string };
interface Props {
  clients: Client[];
  value: string;
  setValue: (clientId: string) => void;
}
export const ClientFilter = ({ clients, value, setValue }: Props) => (
  <select
    className="border px-3 py-2 rounded-md text-sm"
    value={value}
    onChange={e => setValue(e.target.value)}
  >
    <option value="">All Clients</option>
    {clients.map(c => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
);
