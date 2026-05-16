import { useEffect, useRef } from "react";

type FolderCheckboxProps = {
  fullyChecked: boolean;
  partiallyChecked: boolean;
  loading: boolean;
  onChange: () => void;
};

export function FolderCheckbox({
  fullyChecked,
  partiallyChecked,
  loading,
  onChange,
}: FolderCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !fullyChecked && partiallyChecked;
    }
  }, [fullyChecked, partiallyChecked]);

  if (loading) {
    return <span className="file-spinner" />;
  }

  return (
    <input
      type="checkbox"
      className="table-checkbox"
      checked={fullyChecked}
      ref={ref}
      onChange={onChange}
    />
  );
}
