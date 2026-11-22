const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function profileDate(date: Date) {
  return `${dateFormat.format(date)} UTC`;
}
