import { useEffect, useRef } from "react";

type FolderCheckboxProps = {
  fullyChecked: boolean;
  partiallyChecked: boolean;
  onChange: () => void;
};

export function FolderCheckbox({
  fullyChecked,
  partiallyChecked,
  onChange,
}: FolderCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !fullyChecked && partiallyChecked;
    }
  }, [fullyChecked, partiallyChecked]);

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
