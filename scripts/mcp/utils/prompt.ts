import inquirer from 'inquirer'

export async function confirmAction(message: string, forceYes: boolean): Promise<boolean> {
  if (forceYes) return true
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    { type: 'confirm', name: 'confirmed', message, default: false },
  ])
  return confirmed
}

export async function selectOption<T extends string>(message: string, choices: T[]): Promise<T> {
  const { selected } = await inquirer.prompt<{ selected: T }>([
    { type: 'list', name: 'selected', message, choices },
  ])
  return selected
}
