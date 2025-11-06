interface ManagerFilterProps {
  managers: string[]
  selectedManager: string
  onChange: (manager: string) => void
}

const ManagerFilter = ({ managers, selectedManager, onChange }: ManagerFilterProps) => (
  <div className="manager-filter">
    <label htmlFor="manager-filter-select">Manager</label>
    <select
      id="manager-filter-select"
      value={selectedManager}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="all">All managers</option>
      {managers.map((manager) => (
        <option key={manager} value={manager}>
          {manager}
        </option>
      ))}
    </select>
  </div>
)

export default ManagerFilter
