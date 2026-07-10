import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable } from './components/DataTable'
import type { ColumnDef } from './types'

interface Person {
  id: string
  name: string | null
  age?: number
}

const people: Person[] = [
  { id: 'person-1', name: 'Ada', age: 36 },
  { id: 'person-2', name: null },
]

const columns: ColumnDef<Person>[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'age', label: 'Age', type: 'number' },
]

describe('plain object row compatibility', () => {
  it('renders a domain interface without an index signature or casts', () => {
    render(
      <DataTable
        data={people}
        columns={columns}
        rowKey="id"
        preset="minimal"
        onRowClick={(person) => person.name}
      />,
    )

    expect(screen.getByText('Ada')).toBeTruthy()
  })
})
