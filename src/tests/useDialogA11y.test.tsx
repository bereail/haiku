import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDialogA11y } from '../hooks/useDialogA11y'

function TestDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialogA11y(onClose)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="test" tabIndex={-1}>
      <button>Cerrar</button>
      <input placeholder="primero" />
      <button>Guardar</button>
    </div>
  )
}

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button>Abrir</button>
      {open && <TestDialog onClose={onClose} />}
    </div>
  )
}

describe('useDialogA11y', () => {
  it('enfoca el primer elemento del diálogo al abrir', () => {
    render(<Harness open onClose={() => {}} />)
    expect(screen.getByText('Cerrar')).toHaveFocus()
  })

  it('atrapa el foco: Shift+Tab desde el primero va al último, Tab desde el último vuelve al primero', async () => {
    const user = userEvent.setup()
    render(<Harness open onClose={() => {}} />)

    expect(screen.getByText('Cerrar')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('Guardar')).toHaveFocus()

    await user.tab()
    expect(screen.getByText('Cerrar')).toHaveFocus()
  })

  it('Escape llama a onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('al cerrarse, devuelve el foco a quien abrió el diálogo', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button onClick={() => setOpen(true)}>Abrir</button>
          {open && <TestDialog onClose={() => setOpen(false)} />}
        </div>
      )
    }
    render(<Controlled />)
    const openBtn = screen.getByText('Abrir')
    await user.click(openBtn)
    expect(screen.getByText('Cerrar')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openBtn).toHaveFocus()
  })

  it('respeta un autoFocus existente en vez de pisarlo con el primer elemento', () => {
    function AutoFocusDialog({ onClose }: { onClose: () => void }) {
      const ref = useDialogA11y(onClose)
      return (
        <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
          <button>Cerrar</button>
          <input placeholder="con autofocus" autoFocus />
        </div>
      )
    }
    render(<AutoFocusDialog onClose={() => {}} />)
    expect(screen.getByPlaceholderText('con autofocus')).toHaveFocus()
  })
})
