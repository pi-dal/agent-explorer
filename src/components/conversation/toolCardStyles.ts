import {
  accentPairHighlight,
  selectedRing,
} from '../../styles/uiClasses'

export function toolCardBorderClass({
  selected,
  pairHighlighted,
  isFailed = false,
}: {
  selected: boolean
  pairHighlighted: boolean
  isFailed?: boolean
}): string {
  if (selected) {
    return selectedRing
  }
  if (pairHighlighted) {
    return accentPairHighlight
  }
  if (isFailed) {
    return 'border-danger-border'
  }
  return 'border-border'
}
