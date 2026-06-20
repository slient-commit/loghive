import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss');

export const formatDateShort = (date) => dayjs(date).format('MMM D, HH:mm');

export const formatRelative = (date) => dayjs(date).fromNow();

export const truncate = (str, length = 100) => {
  if (!str || str.length <= length) return str;
  return str.substring(0, length) + '...';
};
