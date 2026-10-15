import * as React from "react"

// shadcn
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"

// assets
import { SearchIcon } from "lucide-react"

//  ------------------------------ | KBD - INPUT GROUP | ------------------------------  //
// Orijinal 21st.dev bileşeni sabit bir örnekti; siteye bağlanabilsin diye input'un
// tüm özellikleri (value, onChange, placeholder...) ve kısayol tuşları dışarıdan verilebiliyor.

type Props = React.ComponentProps<"input"> & {
  /** Sağda gösterilecek kısayol tuşları, örn. ["Ctrl", "K"] */
  shortcut?: string[]
  className?: string
}

const KbdInputGroup = React.forwardRef<HTMLInputElement, Props>(
  ({ shortcut = ["⌘", "K"], className, placeholder = "Search...", ...inputProps }, ref) => {
    return (
      <InputGroup className={className}>
        <InputGroupInput ref={ref} placeholder={placeholder} {...inputProps} />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        {/* Kısayol rozetleri telefonda gizli (klavye yok) */}
        {shortcut.length > 0 && (
          <InputGroupAddon align="inline-end" className="max-sm:hidden">
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </InputGroupAddon>
        )}
      </InputGroup>
    )
  }
)
KbdInputGroup.displayName = "KbdInputGroup"

export default KbdInputGroup
