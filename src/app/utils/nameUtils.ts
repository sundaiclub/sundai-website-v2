export function swapFirstLetters(name: string): string {

  // Original implementation commented out - revert to normal names
  return name;

  // Implementation for swapping first and last letters

  // const parts = name.split(' ');
  
  // if (parts.length < 2) {
  //   // For single names, swap first and last letters
  //   if (name.length < 2) return name; // Handle single-letter names
  //   return name[name.length - 1] + name.slice(1, -1) + name[0];
  // }
  
  // const firstName = parts[0];
  // const lastName = parts[parts.length - 1];
  
  // const newFirstName = lastName[0] + firstName.slice(1);
  // const newLastName = firstName[0] + lastName.slice(1);
  
  // parts[0] = newFirstName;
  // parts[parts.length - 1] = newLastName;
  
  // return parts.join(' ');
} 