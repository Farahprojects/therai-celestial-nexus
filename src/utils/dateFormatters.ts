
export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) + ' at ' + date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

export const getRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInYears > 0) {
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  } else if (diffInMonths > 0) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  } else if (diffInWeeks > 0) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  } else if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else {
    return 'Today';
  }
};
